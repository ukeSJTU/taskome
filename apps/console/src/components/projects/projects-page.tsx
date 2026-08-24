import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListProjectsQueryKey,
  listProjects,
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useUnarchiveProject,
  useUpdateProject,
} from "@/api/generated/projects/projects";
import type { ProblemDetails, Project } from "@/api/generated/models";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@taskome/ui/components/alert-dialog";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@taskome/ui/components/alert";
import { Badge } from "@taskome/ui/components/badge";
import { Button } from "@taskome/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@taskome/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@taskome/ui/components/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@taskome/ui/components/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@taskome/ui/components/field";
import { Input } from "@taskome/ui/components/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@taskome/ui/components/item";
import { Skeleton } from "@taskome/ui/components/skeleton";
import { Spinner } from "@taskome/ui/components/spinner";
import { Textarea } from "@taskome/ui/components/textarea";
import {
  ArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const listQueryKey = getListProjectsQueryKey({ status: "all" });

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "detail" in error &&
    typeof error.detail === "string"
  ) {
    return error.detail;
  }

  return "Something went wrong. Please try again.";
}

function descriptionValue(description: string) {
  const trimmedDescription = description.trim();
  return trimmedDescription.length === 0 ? null : trimmedDescription;
}

function normalizedCodePointLength(value: string) {
  return [...value.trim().normalize("NFKC")].length;
}

function ProjectsLoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading projects">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

function ProjectEditorDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | undefined;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(project?.name ?? "");
  const [description, setDescription] = React.useState(project?.description ?? "");
  const [nameError, setNameError] = React.useState<string>();
  const [descriptionError, setDescriptionError] = React.useState<string>();
  const isEditing = project !== undefined;

  const finishMutation = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: [listQueryKey[0]] });
    toast.success(message);
    onOpenChange(false);
  };

  const createMutation = useCreateProject<ProblemDetails>({
    mutation: {
      onSuccess: () => finishMutation("Project created."),
      onError: (error) => toast.error(errorMessage(error)),
    },
  });
  const updateMutation = useUpdateProject<ProblemDetails>({
    mutation: {
      onSuccess: () => finishMutation("Project updated."),
      onError: (error) => toast.error(errorMessage(error)),
    },
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const nextNameError =
      !project?.isDefault && trimmedName.length === 0
        ? "Enter a project name."
        : normalizedCodePointLength(name) > 100
          ? "Project name must be at most 100 characters."
          : undefined;
    const nextDescriptionError =
      normalizedCodePointLength(description) > 1000
        ? "Project description must be at most 1000 characters."
        : undefined;

    if (nextNameError || nextDescriptionError) {
      setNameError(nextNameError);
      setDescriptionError(nextDescriptionError);
      return;
    }

    setNameError(undefined);
    setDescriptionError(undefined);
    const nextDescription = descriptionValue(description);

    if (project) {
      updateMutation.mutate({
        pathParams: { projectId: project.id },
        data: project.isDefault
          ? { description: nextDescription }
          : { name: trimmedName, description: nextDescription },
      });
      return;
    }

    createMutation.mutate({ data: { name: trimmedName, description: nextDescription } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit project" : "Create project"}</DialogTitle>
          <DialogDescription>
            {project?.isDefault
              ? "Default Project is the permanent fallback for work without an explicit project. Its name cannot be changed."
              : "Projects keep related jobs and files together."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="contents">
          <FieldGroup>
            <Field data-invalid={nameError !== undefined}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={project?.isDefault || isPending}
                autoFocus={!project?.isDefault}
                aria-invalid={nameError !== undefined}
              />
              {project?.isDefault ? (
                <FieldDescription>The system fallback name is fixed.</FieldDescription>
              ) : null}
              <FieldError>{nameError}</FieldError>
            </Field>
            <Field data-invalid={descriptionError !== undefined}>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isPending}
                rows={4}
                placeholder="What belongs in this project?"
                aria-invalid={descriptionError !== undefined}
              />
              <FieldDescription>
                Optional · {normalizedCodePointLength(description)}/1000 characters
              </FieldDescription>
              <FieldError>{descriptionError}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  project,
  onOpenChange,
}: {
  project: Project | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteProject<ProblemDetails>({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: [listQueryKey[0]] });
        toast.success("Project permanently deleted.");
        onOpenChange(false);
      },
      onError: (error) => toast.error(errorMessage(error)),
    },
  });

  return (
    <AlertDialog open={project !== undefined} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{project?.name}” permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            Only an empty project can be deleted. Taskome will never move or delete its jobs and
            files automatically. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending || project === undefined}
            onClick={() => {
              if (project) {
                deleteMutation.mutate({ pathParams: { projectId: project.id } });
              }
            }}
          >
            {deleteMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ProjectRow({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [listQueryKey[0]] });
  const archiveMutation = useArchiveProject<ProblemDetails>({
    mutation: {
      onSuccess: async () => {
        await refresh();
        toast.success("Project archived.");
      },
      onError: (error) => toast.error(errorMessage(error)),
    },
  });
  const unarchiveMutation = useUnarchiveProject<ProblemDetails>({
    mutation: {
      onSuccess: async () => {
        await refresh();
        toast.success("Project restored.");
      },
      onError: (error) => toast.error(errorMessage(error)),
    },
  });
  const isPending = archiveMutation.isPending || unarchiveMutation.isPending;

  return (
    <Item variant="outline" className={project.status === "archived" ? "bg-muted/20" : undefined}>
      <ItemMedia className="flex size-9 rounded-xl bg-muted text-muted-foreground">
        {project.status === "archived" ? (
          <FolderIcon className="size-4" />
        ) : (
          <FolderOpenIcon className="size-4" />
        )}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <span className="truncate">{project.name}</span>
          {project.isDefault ? <Badge variant="secondary">Default</Badge> : null}
          {project.status === "archived" ? <Badge variant="outline">Archived</Badge> : null}
        </ItemTitle>
        <ItemDescription>
          {project.description ??
            (project.isDefault
              ? "Fallback for jobs and files without an explicit project."
              : "No description")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={`Actions for ${project.name}`}
              />
            }
          >
            {isPending ? <Spinner /> : <MoreHorizontalIcon />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {project.status === "active" ? (
              <>
                <DropdownMenuItem onClick={() => onEdit(project)}>
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
                {!project.isDefault ? (
                  <DropdownMenuItem
                    onClick={() =>
                      archiveMutation.mutate({ pathParams: { projectId: project.id } })
                    }
                  >
                    <ArchiveIcon />
                    Archive
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => unarchiveMutation.mutate({ pathParams: { projectId: project.id } })}
              >
                <RotateCcwIcon />
                Restore
              </DropdownMenuItem>
            )}
            {!project.isDefault ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
                  <Trash2Icon />
                  Delete permanently
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  );
}

function ProjectSection({
  title,
  description,
  projects,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ItemGroup>
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ItemGroup>
    </section>
  );
}

export function ProjectsPage() {
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project>();
  const [deletingProject, setDeletingProject] = React.useState<Project>();
  const projectsQuery = useInfiniteQuery({
    queryKey: listQueryKey,
    queryFn: ({ pageParam }) =>
      listProjects({
        status: "all",
        limit: 100,
        ...(pageParam.length > 0 ? { cursor: pageParam } : {}),
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const projects = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeProjects = projects.filter((project) => project.status === "active");
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const ordinaryActiveProjects = activeProjects.filter((project) => !project.isDefault);

  const openCreateDialog = () => {
    setEditingProject(undefined);
    setEditorOpen(true);
  };
  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setEditorOpen(true);
  };

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Organize related jobs and files. Work without an explicit project always goes to
              Default Project.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="self-start">
            <PlusIcon data-icon="inline-start" />
            Create project
          </Button>
        </header>

        {projectsQuery.isPending ? <ProjectsLoadingState /> : null}

        {projectsQuery.isError ? (
          <Alert variant="destructive">
            <RefreshCcwIcon />
            <AlertTitle>Couldn’t load projects</AlertTitle>
            <AlertDescription>{errorMessage(projectsQuery.error)}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => void projectsQuery.refetch()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {projectsQuery.isSuccess ? (
          <div className="space-y-10">
            <ProjectSection
              title="Active"
              description="Active projects can receive new jobs and files."
              projects={activeProjects}
              onEdit={openEditDialog}
              onDelete={setDeletingProject}
            />

            {ordinaryActiveProjects.length === 0 ? (
              <Empty className="border bg-muted/10 py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderIcon />
                  </EmptyMedia>
                  <EmptyTitle>No additional projects yet</EmptyTitle>
                  <EmptyDescription>
                    Default Project is ready to use. Create another project when a body of work
                    needs its own boundary.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={openCreateDialog}>
                    <PlusIcon data-icon="inline-start" />
                    Create project
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}

            {archivedProjects.length > 0 ? (
              <ProjectSection
                title="Archived"
                description="Archived projects keep their contents but cannot receive new work until restored."
                projects={archivedProjects}
                onEdit={openEditDialog}
                onDelete={setDeletingProject}
              />
            ) : null}

            {projectsQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  disabled={projectsQuery.isFetchingNextPage}
                  onClick={() => void projectsQuery.fetchNextPage()}
                >
                  {projectsQuery.isFetchingNextPage ? <Spinner data-icon="inline-start" /> : null}
                  {projectsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {editorOpen ? (
        <ProjectEditorDialog open onOpenChange={setEditorOpen} project={editingProject} />
      ) : null}
      <DeleteProjectDialog
        project={deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(undefined)}
      />
    </main>
  );
}
