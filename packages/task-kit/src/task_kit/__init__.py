_REGISTRATION_NOT_IMPLEMENTED = "task-kit registration is not implemented yet"


def register_task(*args: object, **kwargs: object) -> None:
    """Reserve task registration until the shared REST and MCP wiring is implemented."""
    del args, kwargs
    raise NotImplementedError(_REGISTRATION_NOT_IMPLEMENTED)
