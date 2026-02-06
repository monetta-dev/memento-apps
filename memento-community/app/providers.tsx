'use client';

import React from 'react';
import { ConfigProvider } from 'antd';
import AntdRegistry from '../lib/AntdRegistry';

import theme from '../theme/themeConfig';

const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <AntdRegistry>
            <ConfigProvider theme={theme}>
                {children}
            </ConfigProvider>
        </AntdRegistry>
    );
};

export default Providers;
