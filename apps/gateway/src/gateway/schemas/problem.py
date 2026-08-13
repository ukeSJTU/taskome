from pydantic import BaseModel


class ValidationIssue(BaseModel):
    location: list[str | int]
    message: str
    code: str


class ProblemDetails(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    request_id: str
    errors: list[ValidationIssue] | None = None


class Identity(BaseModel):
    aud: str | list[str]
    iss: str
    sub: str
