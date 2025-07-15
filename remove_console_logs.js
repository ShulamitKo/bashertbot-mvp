const fs = require('fs');
const path = require('path');

// רשימת הקבצים לעיבוד
const files = [
  'src/pages/DashboardPage.tsx',
  'src/lib/sessions.ts',
  'src/lib/proposals.ts'
];

// פונקציה למחיקת הדפסות קונסול
function removeConsoleLogs(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // הסרת שורות שמתחילות עם console.
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('console.log(') && 
             !trimmed.startsWith('console.error(') && 
             !trimmed.startsWith('console.warn(') && 
             !trimmed.startsWith('console.info(') && 
             !trimmed.startsWith('console.debug(');
    });
    
    const newContent = filteredLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    const removedCount = lines.length - filteredLines.length;
    console.log(`✅ ${filePath}: הוסרו ${removedCount} הדפסות קונסול`);
    
  } catch (error) {
    console.error(`❌ שגיאה בעיבוד ${filePath}:`, error.message);
  }
}

// עיבוד כל הקבצים
console.log('🔄 מתחיל מחיקת הדפסות קונסול...');
files.forEach(removeConsoleLogs);
console.log('✅ הושלם!'); 