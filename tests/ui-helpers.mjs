export async function fullPlan(ui){const button=ui.getByRole('button',{name:'直接看完整安排',exact:true});if(await button.count()&&await button.isVisible())await button.click()}
