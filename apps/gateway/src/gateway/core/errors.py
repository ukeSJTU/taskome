from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING, Any, cast

import structlog
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from gateway.core.config import Environment
from gateway.core.middleware import security_headers
from gateway.schemas.problem import ProblemDetails, ValidationIssue

if TYPE_CHECKING:
    from fastapi import FastAPI, Request


class AppError(Exception):
    def __init__(
        self,
        *,
        error_type: str,
        title: str,
        status_code: int,
        detail: str,
    ) -> None:
        super().__init__(detail)
        self.error_type = error_type
        self.title = title
        self.status_code = status_code
        self.detail = detail


def problem_responses(
    *status_codes: int,
    include_default: bool = True,
) -> dict[int | str, dict[str, Any]]:
    responses: dict[int | str, dict[str, Any]] = {
        status_code: {
            "description": HTTPStatus(status_code).phrase,
            "content": {
                "application/problem+json": {
                    "schema": {"$ref": "#/components/schemas/ProblemDetails"}
                }
            },
        }
        for status_code in status_codes
    }
    if include_default:
        responses["default"] = {
            "description": "Problem response",
            "content": {
                "application/problem+json": {
                    "schema": {"$ref": "#/components/schemas/ProblemDetails"}
                }
            },
        }
    return responses


def problem_response(  # noqa: PLR0913
    request: Request,
    *,
    error_type: str,
    title: str,
    status_code: int,
    detail: str,
    errors: list[ValidationIssue] | None = None,
) -> JSONResponse:
    problem = ProblemDetails(
        type=f"urn:taskome:error:{error_type}",
        title=title,
        status=status_code,
        detail=detail,
        instance=request.url.path,
        request_id=request.state.request_id,
        errors=errors,
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(mode="json", exclude_none=True),
        media_type="application/problem+json",
    )


def http_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    http_error = cast("StarletteHTTPException", exc)
    if http_error.status_code == HTTPStatus.NOT_FOUND:
        response = problem_response(
            request,
            error_type="not-found",
            title="Not Found",
            status_code=HTTPStatus.NOT_FOUND,
            detail="The requested resource was not found.",
        )
        response.headers.update(http_error.headers or {})
        return response

    try:
        status_phrase = HTTPStatus(http_error.status_code).phrase
    except ValueError:
        status_phrase = "HTTP Error"
    detail = http_error.detail if isinstance(http_error.detail, str) else status_phrase
    response = problem_response(
        request,
        error_type=status_phrase.lower().replace(" ", "-"),
        title=status_phrase,
        status_code=http_error.status_code,
        detail=detail,
    )
    response.headers.update(http_error.headers or {})
    return response


def request_validation_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    validation_error = cast("RequestValidationError", exc)
    issues = [
        ValidationIssue(
            location=[part if isinstance(part, int | str) else str(part) for part in error["loc"]],
            message=error["msg"],
            code=error["type"],
        )
        for error in validation_error.errors()
    ]
    return problem_response(
        request,
        error_type="request-validation",
        title="Request Validation Failed",
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        detail="The request is invalid.",
        errors=issues,
    )


def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    app_error = cast("AppError", exc)
    return problem_response(
        request,
        error_type=app_error.error_type,
        title=app_error.title,
        status_code=app_error.status_code,
        detail=app_error.detail,
    )


def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    structlog.get_logger().exception(
        "unhandled_error",
        exc_info=(type(exc), exc, exc.__traceback__),
        request_id=request.state.request_id,
    )
    response = problem_response(
        request,
        error_type="internal-error",
        title="Internal Server Error",
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        detail="An unexpected error occurred.",
    )
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers.update(
        security_headers(
            include_hsts=request.app.state.settings.app_environment is Environment.PRODUCTION,
        ),
    )
    return response


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
