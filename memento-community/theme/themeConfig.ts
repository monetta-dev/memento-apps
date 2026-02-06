import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
    token: {
        fontSize: 16,
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif',
        colorPrimary: '#223a70', // 紺色 (Koki-hanada) - Keeping unified primary color
        colorBgBase: '#fcfaf2', // 胡粉色 (Gofun)
        colorTextBase: '#2b2b2b', // 墨色 (Sumi)
        colorError: '#c9171e', // 朱色 (Shu-iro)
        borderRadius: 4,
    },
};

export default theme;
