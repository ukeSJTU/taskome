from gateway.api.v1.router import auth_api_router, router


def test_business_api_router_owns_the_versioned_namespace() -> None:
    assert router.prefix == "/v1"
    assert auth_api_router.prefix == "/api/v1"
