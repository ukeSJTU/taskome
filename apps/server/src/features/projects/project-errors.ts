export class ProjectNameConflictError extends Error {
  constructor() {
    super("A Project with this name already exists.");
    this.name = "ProjectNameConflictError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super("The Project does not exist.");
    this.name = "ProjectNotFoundError";
  }
}

export class DefaultProjectImmutableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefaultProjectImmutableError";
  }
}

export class ProjectArchivedError extends Error {
  constructor() {
    super("Unarchive the Project before modifying it.");
    this.name = "ProjectArchivedError";
  }
}

export class ProjectNotEmptyError extends Error {
  constructor() {
    super("Move all Jobs and saved files out of the Project before deleting it.");
    this.name = "ProjectNotEmptyError";
  }
}

export class InvalidProjectCursorError extends Error {
  constructor() {
    super("The Project cursor is invalid.");
    this.name = "InvalidProjectCursorError";
  }
}
