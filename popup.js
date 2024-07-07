document.addEventListener('DOMContentLoaded', function() {
  browser.storage.sync.get('cleanDays', data => {
    document.getElementById('cleanDays').textContent = `Clean days: ${data.cleanDays || 0}`;
  });
});
