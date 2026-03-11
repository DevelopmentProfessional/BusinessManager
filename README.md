
sales from the sales page aftrer checkout should update the inventory dataset

	Add Client :   
make the phone number field abide by the number format 
	Edit client: 
format it like the add client, For the Services history and product history, put in reverse chronological where the most recent is near the bottom, if the service is upcoming, selecting it should open the appoiuntmenbt edit compoent to allow for that compoenent to be edited 
	

	Inventory 
For each descriptive feature turn each feature into an accordion in the4 header section, move the remove button to the left most of the header and put it as a trashcan, in the compact/traning mode, it shoud be a trash can for both,
The title can go to the left most as well but to the right of the removeo button.
to the right most of the accordion heqader, but the selected options in a comma separated list. so it would look like this 
[remove][Title][mx-auto][Option1,Option2,Option3]
For the options table within the accordion body, remove the inner border of the table body, remove the column header vertical borders from the inside of the column header row
move the new optio0n name input and the add option button to the right most of the row 


	Clients
On the -purchase history modal... float the table to the bottom
on the service history... move the upcoming to the bottom and the past to the top. order by descending. 
on the service history... make the row items open the appointment edit component so the date or service can be updated for example.
on the service history... remove the top right close button

	employee
fix the insurance plans edit and remove buttons 
investigate the wages and payroll pagfef functionality... the rate isnt set 
On the add employee modal. the active buttons needs pb-2	
	
	Documents
For the manage categories... make this page style look like the insurance plans modal on the employee page
Update hte icons on the right most side 

	Components
for the dropdowns, when the question mark is high lighted, somtimes the popup appears on the sinide of the dropdown, it should be on the oiutside of the dropdown. 
	
	sales
add a scroll to sales history and a footer and a close button in the footer 
When the clkient button in the footer is selkected, it opens another row, the button in that row should be a cirfcle with 3rem width and height 
 when selecting the client, if they have a service schedulked, that service should appear in thier cart 
 
	Schedule
Edit appointment: add a paid button that is a toggle and is connected to the checkout on the sales page so when the sales button is selected and the service is piad. the paid toggle button should be set to paid, otherwise it stays at unpaid. 
add a discount option 
	on the appointmnet show which resources are consumed and thier resource consumption rate. 

Services
	add a resource consumption rate to the resrouces as a percentage



automatically generateed task assignment that are based on paid client orders. then it will display on it the amount of each item that needs to be produced and as a result the amount of resources it will consume.
it checks in the inventory for how much stokc is available. if any is needed, it finds the difference between the current amount in stock and the remaining amount needed to increase the minimum threashold. 
on the task it formulates emails to contact suppliers on what is needed via a template and is checkable and sendable from that point, after sneding, the send icon appears. 
this is all hjappening on the task event. The task is essentially automaticallytt created and the duration is the amount of time it takes to create <=1 batch, each batch is conectnted to one asset6 so if its 4 assets the throughput can be 4 batches per dureation... but if there are two assets and 4 batches need to be made, then the duration would be 2... likewise, if its 3 batches and only 4 assets, it still 2 becqause only 2 can be processed at a time. i think its the mod.. not certain. 

task are conencted to products. 

products should bne connected to resources and assets such that if they are created by the busnness, then they would consume resoureces of the business and whiile being produced, take up an asset. from this they would have a duration 

how does the bsuiness know it needs a new assset? if a task would queue on an asset, then on the asset, there hsould be a max queue threshold, when reached, the Asset would be flagged with a badge that shows an upward line chart indicating that more assets are needed in order to meet demand. 
	 
