export async function fullPlan(ui){const button=ui.getByRole('button',{name:'直接看完整安排',exact:true});if(await button.count()&&await button.isVisible())await button.click()}

export async function navigate(ui,name){const toggle=ui.getByRole('button',{name:'打开导航',exact:true});if(await toggle.count()&&await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await ui.getByRole('link',{name}).click()}
