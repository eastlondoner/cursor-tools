export class StagehandError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InitializationError extends StagehandError {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message, originalError);
  }
}

export class NavigationError extends StagehandError {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message, originalError);
  }
}

export class ActionError extends StagehandError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class ObservationError extends StagehandError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class ExtractionSchemaError extends StagehandError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}
