/** Thrown when user input fails validation before it reaches the server. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
