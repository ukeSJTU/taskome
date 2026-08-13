from gateway.api.v1.router import router


def test_business_api_router_owns_the_versioned_namespace() -> None:
    assert router.prefix == "/v1"
