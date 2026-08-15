import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

/**
 * Generates bulk PDFs from a template image, mappings, and CSV data.
 * @param {string} templateImage - Data URL of the base image.
 * @param {Array} mappings - Array of mapping objects { x, y, width, height, variableName, fontSize }.
 * @param {Array} csvData - Array of objects parsed from CSV.
 */
export async function generateBulkDocuments(templateImage, mappings, csvData) {
  const zip = new JSZip()
  
  // Create a hidden container for rendering
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-9999px'
  container.style.left = '-9999px'
  // Using a standard 800px width as the base scale from the workspace
  container.style.width = '800px'
  // Calculate height based on A4 ratio to maintain scale, approx 1131px
  container.style.height = '1131px' 
  container.style.backgroundColor = 'white'
  document.body.appendChild(container)

  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i]
    
    // Clear container
    container.innerHTML = ''
    
    // Add Image
    const img = document.createElement('img')
    img.src = templateImage
    img.style.position = 'absolute'
    img.style.top = '0'
    img.style.left = '0'
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'contain'
    container.appendChild(img)
    
    // Add Mapped Fields
    mappings.forEach(mapping => {
      const field = document.createElement('div')
      field.style.position = 'absolute'
      // Parse float to remove 'px' if react-rnd passed it as string, else use as number
      field.style.left = typeof mapping.x === 'string' ? mapping.x : `${mapping.x}px`
      field.style.top = typeof mapping.y === 'string' ? mapping.y : `${mapping.y}px`
      field.style.width = typeof mapping.width === 'string' ? mapping.width : `${mapping.width}px`
      field.style.height = typeof mapping.height === 'string' ? mapping.height : `${mapping.height}px`
      
      field.style.fontSize = `${mapping.fontSize}px`
      field.style.fontFamily = 'sans-serif'
      field.style.color = '#000000'
      field.style.display = 'flex'
      field.style.alignItems = 'center'
      field.style.justifyContent = 'center'
      field.style.overflow = 'hidden'
      field.style.whiteSpace = 'nowrap'
      field.style.fontWeight = 'bold'
      
      // Get value from CSV row matching the variable name
      const value = row[mapping.variableName] || ''
      field.innerText = value
      
      container.appendChild(field)
    })

    // Render with html2canvas
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false
    })
    
    // Convert to PDF
    // A4 size in mm: 210 x 297
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png')
    
    // Calculate aspect ratio fit for A4
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    
    // Add to ZIP (Use a column like 'filename' or fallback to index)
    const filename = row.filename || row.site || `document_${i + 1}`
    const sanitizedFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    
    const pdfBlob = pdf.output('blob')
    zip.file(`${sanitizedFilename}.pdf`, pdfBlob)
  }

  // Cleanup DOM
  document.body.removeChild(container)

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, 'bulk_documents.zip')
}
