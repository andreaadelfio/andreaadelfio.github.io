(function(){
  const LIGHT_THEME_START_HOUR = 7;
  const DARK_THEME_START_HOUR = 19;

  function getTimeBasedTheme(date = new Date()){
    const hour = date.getHours();
    return hour >= LIGHT_THEME_START_HOUR && hour < DARK_THEME_START_HOUR
      ? 'light'
      : 'dark';
  }

  function applyTimeBasedTheme(date = new Date()){
    const theme = getTimeBasedTheme(date);
    document.documentElement.dataset.theme = theme;
    return theme;
  }

  function getMsUntilNextThemeChange(date = new Date()){
    const next = new Date(date);
    const hour = date.getHours();

    if(hour < LIGHT_THEME_START_HOUR){
      next.setHours(LIGHT_THEME_START_HOUR, 0, 0, 0);
    }else if(hour < DARK_THEME_START_HOUR){
      next.setHours(DARK_THEME_START_HOUR, 0, 0, 0);
    }else{
      next.setDate(next.getDate() + 1);
      next.setHours(LIGHT_THEME_START_HOUR, 0, 0, 0);
    }

    return Math.max(1000, next.getTime() - date.getTime() + 1000);
  }

  window.siteUtils = {
    LIGHT_THEME_START_HOUR,
    DARK_THEME_START_HOUR,
    getTimeBasedTheme,
    applyTimeBasedTheme,
    getMsUntilNextThemeChange
  };

  applyTimeBasedTheme();
}());
