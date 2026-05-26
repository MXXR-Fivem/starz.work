module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
      extend: {
        boxShadow: {
        purple: 'var(--shadow-purple)',
      }
    },
  },
  plugins: [],
};
