import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const replacements = [
  // Backgrounds
  { regex: /\bbg-white\b(?! dark:)/g, replace: 'bg-white dark:bg-[#1e1e2d]' },
  { regex: /\bbg-gray-50\b(?! dark:)/g, replace: 'bg-gray-50 dark:bg-[#151521]' },
  { regex: /\bbg-gray-100\b(?! dark:)/g, replace: 'bg-gray-100 dark:bg-gray-800' },
  { regex: /\bbg-brand-bg\b(?! dark:)/g, replace: 'bg-brand-bg dark:bg-[#151521]' },
  { regex: /\bbg-brand-sidebar\b(?! dark:)/g, replace: 'bg-brand-sidebar dark:bg-[#1e1e2d]' },
  
  // Text
  { regex: /\btext-gray-900\b(?! dark:)/g, replace: 'text-gray-900 dark:text-gray-100' },
  { regex: /\btext-gray-800\b(?! dark:)/g, replace: 'text-gray-800 dark:text-gray-200' },
  { regex: /\btext-gray-700\b(?! dark:)/g, replace: 'text-gray-700 dark:text-gray-300' },
  { regex: /\btext-gray-600\b(?! dark:)/g, replace: 'text-gray-600 dark:text-gray-400' },
  { regex: /\btext-gray-500\b(?! dark:)/g, replace: 'text-gray-500 dark:text-gray-400' },
  { regex: /\btext-gray-400\b(?! dark:)/g, replace: 'text-gray-400 dark:text-gray-500' },
  { regex: /\btext-black\b(?! dark:)/g, replace: 'text-black dark:text-white' },
  
  // Borders
  { regex: /\bborder-gray-200\b(?! dark:)/g, replace: 'border-gray-200 dark:border-gray-800' },
  { regex: /\bborder-gray-100\b(?! dark:)/g, replace: 'border-gray-100 dark:border-gray-800/50' },
  { regex: /\bborder-gray-300\b(?! dark:)/g, replace: 'border-gray-300 dark:border-gray-700' },
  { regex: /\bborder-brand-border\b(?! dark:)/g, replace: 'border-brand-border dark:border-gray-800' },
]

function processDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath)
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      let changed = false
      for (const { regex, replace } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replace)
          changed = true
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content)
        console.log(`Updated ${fullPath}`)
      }
    }
  }
}

processDir(srcDir)
console.log('Migration complete.')
