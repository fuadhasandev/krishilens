export class TemporaryStoreCapacityError extends Error {
  constructor() {
    super('Temporary investigation storage is at capacity.')
    this.name = 'TemporaryStoreCapacityError'
  }
}
