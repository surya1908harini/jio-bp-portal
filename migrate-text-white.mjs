import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const replacements = [
  // Any dark text color to pure white
  { regex: /dark:text-gray-\d+/g, replace: 'dark:text-white' },
  { regex: /dark:text-slate-\d+/g, replace: 'dark:text-white' },
  { regex: /dark:text-black\b/g, replace: 'dark:text-white' }
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
console.log('Migration text to white complete.')
