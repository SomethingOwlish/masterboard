import { createDemoWorkspace } from './demoWorkspace'
import { createLocalDashboardDemo } from './localDashboardDemo'
import { createLocalSessionDemo } from './localSessionDemo'
import { createLocalLibraryDemo } from './localLibraryDemo'

// One shared in-memory workspace per browser tab. Route changes preserve state;
// a full reload deterministically resets it to demoWorkspaceSeed().
const workspace = createDemoWorkspace()

export const localDashboardDemo = createLocalDashboardDemo(workspace)
export const localSessionDemo = createLocalSessionDemo(workspace)
export const localLibraryDemo = createLocalLibraryDemo(workspace)
