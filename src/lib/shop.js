// The prize shop for the jam that just wrapped. Like jam.js, UPDATE THIS each
// month once review starts: point `jam` at the label the submission form used
// and set a fresh close date. The shop serves LAST month's submitters, so it
// intentionally lags jam.js by one cycle.
export const SHOP = {
  jam: '2026-06', // must match submission_form.jam
  jamName: 'the very serious juniper dev game jam', // display name (lags jam.js by a cycle, so it can't read JAM.name)
  closesAt: '2026-07-13T03:59:00Z', // sunday 2026-07-12, 11:59pm ET
  closesText: 'sunday, july 12 at 11:59pm ET'
};

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL'];
