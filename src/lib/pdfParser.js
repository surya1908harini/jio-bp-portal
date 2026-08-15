import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function extractWorkOrderData(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const strings = textContent.items.map(item => item.str)
      fullText += strings.join(' ') + '\n'
    }

    // Attempt to parse Work Order Number
    // Format: Number : MYT/260072752
    const woMatch = fullText.match(/Number\s*:\s*([A-Z0-9\/]+)/i)
    const woNumber = woMatch ? woMatch[1] : `WO-${Date.now()}`

    // Attempt to parse Items
    // Format: 3213416 C11601- BARBED WIRE 12 GAUGE ... 1,074.60 INR/M
    // We look for a 7 digit number, some text, a number with decimals, and INR/UNIT
    const itemRegex = /(\d{7})\s+(.*?)\s+([\d,]+\.\d{2})\s*INR\/([A-Z0-9]+)/g
    const items = []
    let match

    while ((match = itemRegex.exec(fullText)) !== null) {
      items.push({
        item_code: match[1],
        description: match[2].trim(),
        rate: parseFloat(match[3].replace(/,/g, '')),
        unit: match[4].trim()
      })
    }

    return { woNumber, items, rawText: fullText }
  } catch (error) {
    console.error("Error parsing PDF:", error)
    throw error
  }
}
