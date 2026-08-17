"""ASGI app assembly for the fpocket Task Server."""

from task_kit import TaskDefinition, TaskResources, build_task_server
from task_kit.runtime import TaskServerSettings, build_runtime

from fpocket_server.adapter import DetectPocketsAdapter
from fpocket_server.models import DetectPocketsParams, DetectPocketsValue

settings = TaskServerSettings()
runtime = build_runtime(settings)

app = build_task_server(
    name="fpocket",
    tasks=(
        TaskDefinition(
            name="detect_pockets",
            description="Detect binding pockets in a protein structure with fpocket.",
            params_model=DetectPocketsParams,
            result_model=DetectPocketsValue,
            adapter=DetectPocketsAdapter(),
            resources=TaskResources(num_cpus=1, num_gpus=0),
            max_duration_seconds=600,
        ),
    ),
    runtime=runtime,
)
