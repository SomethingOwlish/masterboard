import { createDemoWorkspace } from './demoWorkspace'
import { createLocalDashboardDemo } from './localDashboardDemo'
import { createLocalSessionDemo } from './localSessionDemo'
import { createLocalLibraryDemo } from './localLibraryDemo'
import { createLocalPublicationDemo } from './localPublicationDemo'
import { createLocalSessionBoardDemo } from './localSessionBoardDemo'

// One shared in-memory workspace per browser tab. Route changes preserve state;
// a full reload deterministically resets it to demoWorkspaceSeed().
const workspace = createDemoWorkspace()

export const localDashboardDemo = createLocalDashboardDemo(workspace)
export const localSessionDemo = createLocalSessionDemo(workspace)
export const localLibraryDemo = createLocalLibraryDemo(workspace)
export const localPublicationDemo = createLocalPublicationDemo(workspace)
export const localSessionBoardDemo = createLocalSessionBoardDemo()
