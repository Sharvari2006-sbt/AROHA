export const colors = {
  surface: '#FDFBF7',
  surfaceSecondary: '#FFFFFF',
  surfaceTertiary: '#F5EFEB',
  surfaceInverse: '#4A4036',
  onSurface: '#4A4036',
  onSurfaceMuted: '#8A7E70',
  onSurfaceInverse: '#FDFBF7',
  brand: '#9CAF88',
  brandDeep: '#7C9270',
  brandSoft: '#E5EDDD',
  orange: '#F4A261',
  orangeSoft: '#FBE3CB',
  yellow: '#E9C46A',
  yellowSoft: '#FBEFC9',
  border: '#EBE3DB',
  borderStrong: '#D6C7B8',
  error: '#E78A61',
  info: '#A8DADC',
  overlay: 'rgba(74, 64, 54, 0.35)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  pill: 999,
};

export const shadow = {
  soft: {
    shadowColor: '#4A4036',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  card: {
    shadowColor: '#4A4036',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

export const font = {
  display: undefined as string | undefined, // use system to keep bundle light
  text: undefined as string | undefined,
};
