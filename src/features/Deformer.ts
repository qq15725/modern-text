import { Feature } from './Feature'

export class Deformer extends Feature {
  deform(): void {
    this._text.deformation?.()
  }
}
