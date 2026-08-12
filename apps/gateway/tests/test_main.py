from gateway import main


def test_main_runs(caplog):
    with caplog.at_level("INFO"):
        main()

    assert "Hello from gateway!" in caplog.text
