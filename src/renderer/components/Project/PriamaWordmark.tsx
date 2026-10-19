import { useEffect, useState } from 'react'

// Mark 01 is one text cursor split down the middle. Closed, the 1px seam between the halves is
// invisible, so it reads as a single caret; as the right half travels it uncovers the name, and the
// two halves come to rest as the open covers of a book with the title on the spread.
const LEFT_HALF = 'M18 8H31.5V56H18V50H25V14H18Z'
const RIGHT_HALF = 'M46 8H32.5V56H46V50H39V14H46Z'

export function PriamaWordmark(): React.JSX.Element {
  // The right half travels the width of the name, so the serif has to be measurable before the
  // animation starts — a font swap mid-flight would move the finish line and jolt the motion.
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    const fonts = document.fonts
    if (!fonts) {
      setFontsReady(true)
      return
    }
    let cancelled = false
    void fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <span className={`launch-wordmark ${fontsReady ? 'launch-wordmark--animate' : 'launch-wordmark--pending'}`}>
      <svg className="launch-wordmark__part" viewBox="18 8 13.5 48" aria-hidden="true">
        <path fill="currentColor" d={LEFT_HALF} />
      </svg>
      <span className="launch-wordmark__slot">
        <span className="launch-wordmark__name">Priama</span>
        <span className="launch-wordmark__mover" aria-hidden="true">
          <svg className="launch-wordmark__part" viewBox="32.5 8 13.5 48">
            <path fill="currentColor" d={RIGHT_HALF} />
          </svg>
        </span>
      </span>
    </span>
  )
}
