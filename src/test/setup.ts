import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// jsdom lacks ResizeObserver, which React Flow needs to measure nodes.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(window, { ResizeObserver: ResizeObserverStub })
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub })
}
