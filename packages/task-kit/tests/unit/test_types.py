# ruff: noqa: S101

from task_kit import INPUT_FILE_ID_JSON_SCHEMA_MARKER, InputFileId


def test_input_file_id_schema_carries_a_recognizable_marker() -> None:
    schema = InputFileId.model_json_schema()

    assert schema[INPUT_FILE_ID_JSON_SCHEMA_MARKER] is True
    assert schema["format"] == "uuid"
