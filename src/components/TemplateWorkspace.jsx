import React, { useRef } from 'react'
import { Rnd } from 'react-rnd'
import { Plus, Trash2 } from 'lucide-react'

export default function TemplateWorkspace({ templateImage, mappings, setMappings }) {
  const containerRef = useRef(null)

  const addMapping = () => {
    const newMapping = {
      id: Date.now().toString(),
      x: 50,
      y: 50,
      width: 150,
      height: 40,
      variableName: `field_${mappings.length + 1}`,
      fontSize: 16
    }
    setMappings([...mappings, newMapping])
  }

  const updateMapping = (id, newProps) => {
    setMappings(mappings.map(m => m.id === id ? { ...m, ...newProps } : m))
  }

  const removeMapping = (id) => {
    setMappings(mappings.filter(m => m.id !== id))
  }

  if (!templateImage) return null

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex gap-4 w-full justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click the button to add a text field. Drag and resize it over your template.
        </p>
        <button onClick={addMapping} className="btn-primary py-2 px-4 shadow-md">
          <Plus size={16} className="mr-2" /> Add Field
        </button>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-white shadow-2xl border border-gray-300"
        style={{ width: '800px', minHeight: '1131px' }} // Standard A4 ratio approximation for web
      >
        <img 
          src={templateImage} 
          alt="Base Template" 
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
        />

        {mappings.map((mapping) => (
          <Rnd
            key={mapping.id}
            size={{ width: mapping.width,  height: mapping.height }}
            position={{ x: mapping.x, y: mapping.y }}
            onDragStop={(e, d) => updateMapping(mapping.id, { x: d.x, y: d.y })}
            onResizeStop={(e, direction, ref, delta, position) => {
              updateMapping(mapping.id, {
                width: ref.style.width,
                height: ref.style.height,
                ...position,
              });
            }}
            bounds="parent"
            className="group absolute border-2 border-dashed border-jio-blue-500 bg-jio-blue-500/10 hover:bg-jio-blue-500/20 transition-colors flex items-center justify-center cursor-move"
          >
            {/* Overlay Controls */}
            <div className="absolute -top-10 left-0 bg-gray-900 text-white rounded p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              <input 
                type="text" 
                value={mapping.variableName}
                onChange={(e) => updateMapping(mapping.id, { variableName: e.target.value })}
                className="bg-gray-800 text-xs px-2 py-1 rounded outline-none w-24"
                placeholder="Header Name"
              />
              <input 
                type="number" 
                value={mapping.fontSize}
                onChange={(e) => updateMapping(mapping.id, { fontSize: Number(e.target.value) })}
                className="bg-gray-800 text-xs px-2 py-1 rounded outline-none w-12 text-center"
                title="Font Size (px)"
              />
              <button 
                onClick={() => removeMapping(mapping.id)}
                className="bg-red-500 hover:bg-red-600 p-1 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Display Text */}
            <div 
              style={{ fontSize: `${mapping.fontSize}px` }} 
              className="text-black font-semibold text-center w-full truncate px-1"
            >
              {`{{${mapping.variableName}}}`}
            </div>
          </Rnd>
        ))}
      </div>
    </div>
  )
}
