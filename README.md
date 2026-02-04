Feature list

inventory : 
	The Top header title of the page is hidden on mobile devices opnce scroling starts, it should stay at the top of the screen but should not be above the table such that it would not be possible for elements to hide behind it such as the table. 
	remove the 84/48 label that shows the amount of products 
	The way how the import should work is that it looks for the header fields and matches them with the column headers of the corresponding table requesting the insert. so the up[load process should display which columns are to be imported underneath the "Import Items from CSV" popup.
	The "add new item" and "edit" item should be designed like the sales card 
	The all types and All stock compoenents should be minimized to thier text width.(manual)
	remove thje count/total indicator next to the asll stock input. (Manual)
	There should be a reasonable sized representation of what the item will look like on the sales page, but it should not take up so muych space on the inventory view or the edit compoenent overall, because on thinner scvreens, the ionputs are not e4asily visible. it should be a preview of the item on the POS PAGE instgead of an image (AI)
	remove the (x) button from the edit item (manual)
	change the (edit Item) on the edit item modal to just (edit) 
	
Schedule :
	Based on the type of appoointment, the layout of adding the event should change 
	move the checkbox and 
	when nothing is in the timeslot for the day, then that cell should be the height of the time. 
	when someone goes to the time section of the day, it should navigate to the current time to put it at the top. 
	highlight the current day on the month and week view 

Sales :
	on the customer search, add an "+" button to create a new client. opens the new client modal 
	
components:
	all the buttons should be on the bottom left within the footer section
	the width should be based on the length of the text within it, no col spacing 

History : 
	add sales history section on the sales page. 

Settings : 
	Add settings for the global settings of the scheduling application. the inital settings will be the start of the day, end of the day, attendace check in required( when selected, it will show the attendance input on the schedules, otherwise not) 

	move the left most menu to the bottom footer of the page that is fixed to the bottom of the page, remove the text, and only keep the icons 
	remove account and API&Debug. 
	Move branding and notification inside General 
	In thje database section, add an import feature there where it should be possible to select the database table, and it will show the table columns in it after selecting the Tabqle form a list. So when the user imports the data via csv format which will be the method of importing. The first top colum,n will be the header column, and the function that processes the import shoiuld look at that header column and then dynamically match that column against the column in the datatable to construct the insert query dynamically and insert the records into the database. But before it does the i9nsert, it should look in the code for character like ' or that would break the insert and replace them with ` 
	The settings are too text heavy on the surface, i think instead of that, add a questionmark icon with a color that blends into the dark/light theme. when sleected, it will show the context of the element in question. 
	
