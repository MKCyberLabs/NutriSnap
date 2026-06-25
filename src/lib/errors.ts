export class NotFoodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoodError';
  }
}
