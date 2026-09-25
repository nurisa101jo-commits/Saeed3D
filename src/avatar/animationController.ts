export class AnimationController{private current='idle'; play(name:string){this.current=name} get state(){return this.current}}
