import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scroll Reveal Hook using IntersectionObserver
 * Automatically detects elements with `.reveal-on-scroll` class
 * and triggers smooth fade-in and translate-up entrance animations.
 */
export default function useScrollReveal() {
  const location = useLocation()

  useEffect(() => {
    const observerCallback = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          observer.unobserve(entry.target)
        }
      })
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.1,
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    
    // Give DOM a small tick to settle after route change/render
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.reveal-on-scroll')
      elements.forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('revealed')
        } else {
          observer.observe(el)
        }
      })
    }, 50)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [location.pathname, location.search])
}
