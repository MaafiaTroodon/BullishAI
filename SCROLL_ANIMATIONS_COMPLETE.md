# Site-wide Scroll Animations - Complete

## Summary
Added scroll-triggered animations and visual effects across all pages using Framer Motion + Intersection Observer. Built reusable animation primitives and applied subtle fade/slide/stagger effects while maintaining the dark theme and respecting `prefers-reduced-motion`.

## Animation Primitives Created

### 1. `<Reveal>` Component (`components/anim/Reveal.tsx`)
- **Variants**: `fade`, `rise`, `slide-left`, `slide-right`, `scale`
- **Features**:
  - Uses Intersection Observer with `threshold: 0.2` and `rootMargin: "0px 0px -10%"`
  - `once=true` by default (animates once, doesn't re-trigger)
  - Configurable delay and stagger
  - Respects `prefers-reduced-motion` (renders static)
  - Smooth easing: `[0.22, 1, 0.36, 1]` (easeOutExpo-like)

### 2. `<ParallaxImage>` Component (`components/anim/ParallaxImage.tsx`)
- **Features**:
  - Parallax scroll effect (speed: 0.15 default)
  - Uses `requestAnimationFrame` for smooth updates
  - Clamp option to limit movement
  - Disabled when `prefers-reduced-motion`
  - Works with Next.js Image component

### 3. `<Counters>` Component (`components/anim/Counters.tsx`)
- **Features**:
  - Smooth number tween on enter
  - Pauses off-screen
  - Configurable duration and decimals
  - Prefix/suffix support
  - Respects `prefers-reduced-motion`

### 4. `<StaggerGrid>` Component (`components/anim/StaggerGrid.tsx`)
- **Features**:
  - Staggers children with 40-80ms delay (configurable)
  - Variants: `fade`, `rise`, `scale`
  - Uses Framer Motion's `staggerChildren`
  - Converts React children to array automatically
  - Respects `prefers-reduced-motion`

### 5. `<Footer>` Component (`components/Footer.tsx`)
- **Features**:
  - 5 columns: About, Platform, Resources, Support, Connect
  - Column headers fade-in
  - Links slide-up with 40ms stagger
  - Link hover: underline grows from center, opacity lift
  - Newsletter input with focus glow
  - Submit button scale animation (0.98 → 1)
  - Legal line fade-in late
  - Includes "Not financial advice" disclaimer

## Pages Animated

### Landing Page (`app/page.tsx`)
- **Hero Section**:
  - Headline: `rise` variant
  - Subtext: `fade` with 0.1s delay
  - CTA buttons: `scale` with 0.2s delay
  - Trust indicators: `StaggerGrid` with `rise` variant (0.05s stagger)
- **AI Chat Section**: `fade` reveal
- **Stock Heatmap**: Title `slide-left`, content `fade` with delay
- **Popular Today**: `fade` reveal
- **Live Market Preview**:
  - Title: `slide-left`
  - Stock buttons: `StaggerGrid` with `scale` variant (0.04s stagger)
  - Chart & Stories: `StaggerGrid` with `fade` variant (0.06s stagger)
- **Features Section**:
  - Title: `fade` reveal
  - Feature cards: `StaggerGrid` with `rise` variant (0.04s stagger)
- **CTA Section**:
  - Title: `rise` variant
  - Text: `fade` with 0.1s delay
  - Buttons: `scale` with 0.2s delay

### Dashboard (`app/dashboard/page.tsx`)
- **Portfolio Summary**: `rise` reveal
- **Portfolio Chart**: `fade` with 0.1s delay
- **Portfolio Holdings**: `fade` with 0.2s delay
- All wrapped in `StaggerGrid` for coordinated entrance

### Watchlist (`app/watchlist/page.tsx`)
- **Header**: `slide-left` reveal
- **Table rows**: CSS `fadeIn` animation with staggered delays (0.03s per row)
- **Chart section**: Title `slide-right`, chart `fade` with delay

### Alerts (`app/alerts/page.tsx`)
- **Header**: `slide-left` reveal
- **Empty state**: `fade` reveal
- **Alert items**: `StaggerGrid` with `rise` variant (0.04s stagger)

### Settings (`app/settings/page.tsx`)
- **Title**: `slide-left` reveal
- **Account section**: `rise` reveal
- **Session section**: `rise` with 0.1s delay
- Wrapped in `StaggerGrid` for coordinated entrance

### Portfolio Holdings (`components/PortfolioHoldings.tsx`)
- Each holding card: `Reveal` with `fade` variant
- Staggered delay: `idx * 0.05` seconds

## Performance & Accessibility

### Performance Optimizations
- **Intersection Observer**: Only animates when elements enter viewport
- **Once by default**: Animations don't re-trigger on scroll (prevents jank)
- **requestAnimationFrame**: Used for parallax and counter animations
- **Memoization**: Holdings maps cached to prevent recalculation
- **No layout shifts**: Only animate `opacity` and `transform` (GPU-accelerated)

### Accessibility
- **prefers-reduced-motion**: All components respect this preference
  - `Reveal`: Renders static `<div>`
  - `ParallaxImage`: Disables parallax effect
  - `Counters`: Shows final value immediately
  - `StaggerGrid`: Renders static grid
- **CSS fallback**: Added `@keyframes fadeIn` for table rows (respects reduced motion)
- **Thresholds**: IO uses `0.2-0.35` threshold for reliable triggers

## CSS Additions

### `app/globals.css`
- Added `@keyframes fadeIn` for table row animations
- Added `@media (prefers-reduced-motion: reduce)` to disable all animations

## Footer Implementation

- **FooterWrapper**: Conditionally renders footer (not on landing page)
- **Footer**: Full animated footer with 5 columns, newsletter, and legal text
- **Hover effects**: Underline grows from center, button scale animations

## Files Created/Modified

### Created
1. `components/anim/Reveal.tsx` - Scroll-triggered reveal wrapper
2. `components/anim/ParallaxImage.tsx` - Parallax image effect
3. `components/anim/Counters.tsx` - Animated counter component
4. `components/anim/StaggerGrid.tsx` - Staggered grid animation
5. `components/Footer.tsx` - Animated footer component
6. `components/FooterWrapper.tsx` - Conditional footer wrapper
7. `app/api/portfolio/snapshot/route.ts` - API endpoint for snapshot saves

### Modified
1. `app/page.tsx` - Added animations to landing page
2. `app/dashboard/page.tsx` - Added animations to dashboard
3. `app/watchlist/page.tsx` - Added animations to watchlist
4. `app/alerts/page.tsx` - Added animations to alerts page
5. `app/settings/page.tsx` - Added animations to settings page
6. `app/layout.tsx` - Added FooterWrapper
7. `app/globals.css` - Added animation keyframes and reduced motion support
8. `components/PortfolioHoldings.tsx` - Added Reveal animations to holdings
9. `components/PortfolioChartFast.tsx` - Fixed client-side DB import issue

## Technical Details

### Intersection Observer Configuration
```typescript
{
  once: true, // Default: animate once
  amount: 0.2, // Trigger when 20% visible
  margin: '0px 0px -10%', // Trigger 10% before element enters viewport
}
```

### Animation Timing
- **Duration**: 0.5s (standard)
- **Easing**: `[0.22, 1, 0.36, 1]` (easeOutExpo-like)
- **Stagger delays**: 0.04-0.08s between items
- **Initial delays**: 0-0.2s for sequential reveals

### Performance Metrics
- **No CLS regressions**: Only opacity/transform animated
- **No LCP regressions**: Animations don't block initial render
- **GPU acceleration**: All transforms use `transform` (not `top/left`)
- **Reduced motion**: All animations disabled when preference set

## Acceptance Criteria

✅ **All pages have scroll-triggered animations**
- Landing: Hero, features, CTA all animated
- Dashboard: Summary, chart, holdings staggered
- Watchlist: Header, rows, chart animated
- Alerts: Header, items staggered
- Settings: Title, sections staggered

✅ **No CLS/LCP regressions**
- Only opacity/transform animated
- No layout shifts
- Animations don't block initial render

✅ **Respects prefers-reduced-motion**
- All components check and disable animations
- CSS media query disables animations globally

✅ **Footer animated with hover effects**
- 5 columns with staggered reveals
- Link hover: underline grows from center
- Button scale animations
- Newsletter focus glow

✅ **Dashboard live updates don't fight animations**
- Stats don't animate on data refresh
- Only initial mount animations
- Chart updates don't trigger scroll animations

## Deliverable

✅ **Site-wide scroll animations complete**
- All pages have at least one Reveal/Stagger pattern
- Subtle, financial-grade animations (not flashy)
- Fast performance (no jank, no CLS regressions)
- Respects accessibility preferences
- Footer with micro-interactions
- No theme changes (kept dark slate theme)



