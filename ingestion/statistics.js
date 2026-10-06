/**
 * Statistics module for TraceFlow
 * Calculates various statistical metrics on latency data
 */

/**
 * Calculate the mean (average) of an array of values
 * @param {number[]} values - Array of numeric values
 * @returns {number} The mean value
 */
function mean(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

/**
 * Calculate the standard deviation of an array of values
 * @param {number[]} values - Array of numeric values
 * @returns {number} The standard deviation
 */
function standardDeviation(values) {
    if (!values || values.length === 0) return 0;
    if (values.length === 1) return 0;
    
    const avg = mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = mean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate the percentile of an array of values
 * @param {number[]} values - Array of numeric values
 * @param {number} p - Percentile to calculate (0-100)
 * @returns {number} The percentile value
 */
function percentile(values, p) {
    if (!values || values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate Exponentially Weighted Moving Average (EWMA)
 * @param {number[]} values - Array of numeric values
 * @param {number} alpha - Smoothing factor (default: 0.2)
 * @returns {number} The EWMA value
 */
function ewma(values, alpha = 0.2) {
    if (!values || values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    let ewmaValue = values[0];
    for (let i = 1; i < values.length; i++) {
        ewmaValue = alpha * values[i] + (1 - alpha) * ewmaValue;
    }
    return ewmaValue;
}

/**
 * Calculate Interquartile Range (IQR)
 * @param {number[]} values - Array of numeric values
 * @returns {number} The IQR value
 */
function iqr(values) {
    if (!values || values.length === 0) return 0;
    if (values.length < 4) return 0;
    
    const q25 = percentile(values, 25);
    const q75 = percentile(values, 75);
    return q75 - q25;
}

/**
 * Calculate all statistics for an array of values
 * @param {number[]} values - Array of numeric values
 * @returns {object} Object containing all statistical metrics
 */
function calculateStatistics(values) {
    if (!values || values.length === 0) {
        return {
            count: 0,
            mean: 0,
            standardDeviation: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            ewma: 0,
            iqr: 0
        };
    }
    
    return {
        count: values.length,
        mean: mean(values),
        standardDeviation: standardDeviation(values),
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        ewma: ewma(values),
        iqr: iqr(values)
    };
}

module.exports = {
    mean,
    standardDeviation,
    percentile,
    ewma,
    iqr,
    calculateStatistics
};
