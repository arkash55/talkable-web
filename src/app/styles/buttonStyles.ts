export const BIG_BUTTON_SX = {
  py: { xs: 1.75, sm: 2 },            // taller tap target
  px: { xs: 2.75, sm: 3.25 },         // wider surface
  minHeight: { xs: 56, sm: 64 },      // >= 48px is recommended; 56–64 feels big
  fontSize: { xs: '1rem', sm: '1.1rem' },
  borderRadius: 2.5,
  letterSpacing: 0.2,
};

// Optional: Add other button variants
export const MEDIUM_BUTTON_SX = {
  py: { xs: 1.25, sm: 1.5 },
  px: { xs: 2, sm: 2.5 },
  minHeight: { xs: 44, sm: 48 },
  fontSize: { xs: '0.9rem', sm: '1rem' },
  borderRadius: 2,
  letterSpacing: 0.1,
};