import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
    token: {
        fontSize: 16,
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif',
        colorPrimary: '#223a70', // 紺色 (Koki-hanada)
        colorBgBase: '#fcfaf2', // 胡粉色 (Gofun) - Warm off-white
        colorTextBase: '#2b2b2b', // 墨色 (Sumi) - Soft black
        colorError: '#c9171e', // 朱色 (Shu-iro) - Used as accent/error
        borderRadius: 4, // Slightly sharper corners for traditional feel
    },
};

export default theme;
