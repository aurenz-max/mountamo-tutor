'use client';

import React from 'react';
import type { DataTableBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaTable } from '../../../../../ui';

interface DataTableBlockProps {
  data: DataTableBlockData;
  index: number;
}

const DataTableBlock: React.FC<DataTableBlockProps> = ({ data, index }) => {
  return (
    <BlockWrapper label={data.label} index={index} accent="emerald" variant="feature">
      <LuminaTable
        accent="emerald"
        caption={data.caption}
        columns={data.headers}
        rows={data.rows}
      />
    </BlockWrapper>
  );
};

export default DataTableBlock;
