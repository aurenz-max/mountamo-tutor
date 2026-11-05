'use client';

import React from 'react';
import { DRAWER_REGISTRY } from '../../../drawers/drawerRegistry';
import type { DrawerBlockData } from '../types';

/** A drawer primitive as a DeepDive section: the drawer's own registered component renders its spec. Ungraded. */
const DrawerBlock: React.FC<{ data: DrawerBlockData }> = ({ data }) => {
  const entry = DRAWER_REGISTRY[data.drawerId as keyof typeof DRAWER_REGISTRY];
  if (!entry || !data.spec) return null;
  const Drawer = entry.component;
  return <div data-deep-dive-drawer={data.drawerId}><Drawer data={data.spec} /></div>;
};

export default DrawerBlock;
