function getRotationAngle(element) {
    const transform = window.getComputedStyle(element).transform
    if (!transform || transform === "none") return 0
    try {
        const matrix = new DOMMatrixReadOnly(transform)
        return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI)
    } catch {
        const values = transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(",").map(Number)
        return values?.length === 6 ? Math.atan2(values[1], values[0]) * (180 / Math.PI) : 0
    }
}

export function startRefreshIconAnimation(icon, animationRef) {
    if (!icon?.animate) return
    const currentAngle = getRotationAngle(icon)
    animationRef.current?.cancel()
    animationRef.current = icon.animate(
        [{ transform: `rotate(${currentAngle}deg)` }, { transform: `rotate(${currentAngle + 360}deg)` }],
        { duration: 650, easing: "linear", iterations: Infinity }
    )
}

export function stopRefreshIconAnimation(icon, animationRef) {
    const activeAnimation = animationRef.current
    if (!icon?.animate || !activeAnimation) return
    const currentAngle = getRotationAngle(icon)
    activeAnimation.cancel()
    const deceleration = icon.animate(
        [{ transform: `rotate(${currentAngle}deg)` }, { transform: `rotate(${currentAngle + 360}deg)` }],
        { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    )
    animationRef.current = deceleration
    deceleration.onfinish = () => {
        if (animationRef.current === deceleration) {
            deceleration.cancel()
            animationRef.current = null
        }
    }
}
