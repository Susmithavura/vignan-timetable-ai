/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eef7ff',
                    100: '#dfeeff',
                    200: '#c3defd',
                    300: '#9ac7ff',
                    400: '#69a7ff',
                    500: '#3a85f6',
                    600: '#256de0',
                    700: '#1d57b7',
                    800: '#1f4a93',
                    900: '#21457b',
                },
                slateish: '#f4f8ff',
            },
            boxShadow: {
                soft: '0 12px 30px rgba(30, 64, 175, 0.08)',
            },
            backgroundImage: {
                hero: 'linear-gradient(135deg, #f3f8ff, #eaf3ff 40%, #f8fbff)',
            },
        },
    },
    plugins: [],
};
