export type EventListenerValue<T = any> = (ev: T) => void
export type EventListenerOptions = boolean | AddEventListenerOptions
export interface EventListener<T = any> {
  value: EventListenerValue<T>
  options?: EventListenerOptions
}

export class EventEmitter<T extends Record<string, any> = Record<string, any>> {
  eventListeners = new Map<keyof T, EventListener | EventListener[]>()

  addEventListener<K extends keyof T>(event: K, listener: EventListenerValue<T[K]>, options?: EventListenerOptions): this {
    const object = { value: listener, options }
    const listeners = this.eventListeners.get(event)
    if (!listeners) {
      this.eventListeners.set(event, object)
    }
    else if (Array.isArray(listeners)) {
      listeners.push(object)
    }
    else {
      this.eventListeners.set(event, [listeners, object])
    }
    return this
  }

  removeEventListener<K extends keyof T>(event: K, listener: EventListenerValue<T[K]>, options?: EventListenerOptions): this {
    if (!listener) {
      this.eventListeners.delete(event)
      return this
    }

    const listeners = this.eventListeners.get(event)

    if (!listeners) {
      return this
    }

    if (Array.isArray(listeners)) {
      const events = []
      for (let i = 0, length = listeners.length; i < length; i++) {
        const object = listeners[i]
        if (
          object.value !== listener
          || (
            typeof options === 'object' && options?.once
            && (typeof object.options === 'boolean' || !object.options?.once)
          )
        ) {
          events.push(object)
        }
      }
      if (events.length) {
        this.eventListeners.set(event, events.length === 1 ? events[0] : events)
      }
      else {
        this.eventListeners.delete(event)
      }
    }
    else {
      if (
        listeners.value === listener
        && (
          (typeof options === 'boolean' || !options?.once)
          || (typeof listeners.options === 'boolean' || listeners.options?.once)
        )
      ) {
        this.eventListeners.delete(event)
      }
    }
    return this
  }

  removeAllListeners(): this {
    this.eventListeners.clear()
    return this
  }

  hasEventListener(event: string): boolean {
    return this.eventListeners.has(event)
  }

  dispatchEvent<K extends keyof T>(event: K, args: T[K]): boolean {
    const listeners = this.eventListeners.get(event)

    if (listeners) {
      if (Array.isArray(listeners)) {
        for (let len = listeners.length, i = 0; i < len; i++) {
          const object = listeners[i]
          if (typeof object.options === 'object' && object.options?.once) {
            this.off(event, object.value, object.options)
          }
          object.value.apply(this, args)
        }
      }
      else {
        if (typeof listeners.options === 'object' && listeners.options?.once) {
          this.off(event, listeners.value, listeners.options)
        }
        listeners.value.apply(this, args)
      }
      return true
    }
    else {
      return false
    }
  }

  on<K extends keyof T>(event: K, listener: EventListenerValue<T[K]>, options?: EventListenerOptions): this {
    return this.addEventListener(event, listener, options)
  }

  once<K extends keyof T>(event: K, listener: EventListenerValue<T[K]>): this {
    return this.addEventListener(event, listener, { once: true })
  }

  off<K extends keyof T>(event: K, listener: EventListenerValue<T[K]>, options?: EventListenerOptions): this {
    return this.removeEventListener(event, listener, options)
  }

  emit<K extends keyof T>(event: K, args: T[K]): void {
    this.dispatchEvent(event, args)
  }
}
