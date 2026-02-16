# Business Manager - Feature List

## CHECK THESE

**Inventory:** 
- The Top header title of the page is hidden on mobile devices once scrolling starts, it should stay at the top of the screen but should not be above the table such that it would not be possible for elements to hide behind it such as the table.
- Remove the 84/48 label that shows the amount of products
- The way how the import should work is that it looks for the header fields and matches them with the column headers of the corresponding table requesting the insert. So the upload process should display which columns are to be imported underneath the "Import Items from CSV" popup.
- The "add new item" and "edit" item should be designed like the sales card
- The all types and All stock components should be minimized to their text width.
- Remove the count/total indicator next to the all stock input.
- There should be a reasonable sized representation of what the item will look like on the sales page, but it should not take up so much space on the inventory view or the edit component overall, because on thinner screens, the inputs are not easily visible. It should be a preview of the item on the POS PAGE instead of an image.
- Remove the (x) button from the edit item
- Change the (edit Item) on the edit item modal to just (edit)
- incorporate demand forcasting there the system takes the hisotircal records and uses that to format the next month and next year based on that. The application should be able to link to RSS feeds to interpolate data on topicsa and extrapolate the numbers to either get one fact, a set of facts, or a table of data in which it can analize and make marketing trends on the amount of supply that will be needed or the amount of products htat wqill be needed. But most of the predictive data will come from the historical data on the previous ytear and the previous quarter and the previous month.
- The minimum stock order qwuantity and the maximum threshold should be a calculation based on how much sales are happening to accomodate the rate of change, so when sales are slowing down, the system should lower the amount of capqacity and lower the min order threshold, however, when sales are going up, the capacity should also increase to match.
- Locations need to have a capacity number on it in terms of volume that it can hold, it can be a formula or it can be calculated by the person in terms of how much of somthing can fit into that area. for instnnace, products have various sizes, so some of those sizes would take up less or more space, without going into major detail about how much space somthing takes up for instance a chair verse a popsicle, The Product column will need a new column, add this column to the database where there is square foot, square meter, square yard, that will be one column with those valuews are selectable for that column. Then there is another number that says how muchj of the product is able to fit into that measurement, essentially, a location could said to have a certain amount of meters like 20 squar emeters, So if a chair takes up 1 square meter, then the facility can cap out at 20 chairs. and when there is a capacity reached at a location, then the  system will let the user know that the locatiopn is near capacity.
- There shoul/d be two styles of locations, 1 location is storage, the other location is operation, In operation, locations can be assinged to poeple, so those locations is less about the matching of square capacity and more about the assets that can go into that location. Some assets can belong to one or more person, and one person can have one or more assets assigned ot them.
- 1 Employee to many asset
- 1 location to many asset
- 1 location to many employee
- 1 asset to many employee
- considering a location is more of a building or a worksite, it should contain many assets and employtess there, and the employees would each have thier own assets, but some assets shouuld be shareable
- The inventory add new inventory item format should look the same as the edit item format. 

**Schedule:**
- Based on the type of appointment, the layout of adding the event should change
- Move the checkbox
- When nothing is in the timeslot for the day, then that cell should be the height of the time.
- When someone goes to the time section of the day, it should navigate to the current time to put it at the top.
- somtimes popele want ot confirm thier appointment is correct, so update the event modal to show the selected items from the dropdown
- on the edit appoiuntment moda, add in a buitton o the right of the dropdown that does nothing but it looks like a checkbox. if it needs to do somthing then it can render the slece3teed item from the dreoip0down and displaye then in the dropdown at the toip instead of putting the count and the people like 3 people it would say the first name of the client or employee on those dropdwns
- expand the width of the employeedrodpown to be w-1200 so that it is responsivle and is able to show all the names
- if possible, make the dropdown in the edit appointment whjere there is the client and employee beiong displayed ina horizontal list, make that list scroilalble to the right if th34e dropdown is too small for the interfgace
- it seems at 100% the scroll bars appear, there can even be some flexing vertivally to almost adjust the schedule on a single row text level so that the scrolling doesnt show up when its not needed for the cells on the schedule
- when the event on the schedule is selected, it should open the edit for that appointment
  
**History:**
- Add sales history section on the sales page.

## CODE THESE 

**Inventory:** 
- companies want to manage procurements. 
- Add these to the item edit component. 
      unit cost 
      weight 
      length 
      height 
      pattern 
      manufactur date 
      expiration date 

**Employee:**
- Add to the database for the employee table a "supervisor" column
- When selecting to edit the employee, the modal should have some tabs on it, each tab can be a unique component. (Details, benefits, permissions, Performance)
- On the details component have their personal details as well as their supervisor and direct reports, their ID number and other information like hire date and location.
- On the benefits component have all the benefits and deductions like their pay, insurance, vacation, and other like information
- On the permissions page should be specific to granting/denying access to pages
- Performance page needs log of reviews, goals, feedbacks, completed and pending tasks stats.

**Sales:**
- On the customer search, add an "+" button to create a new client. Opens the new client modal

**Components:**
- All the buttons should be on the bottom left within the footer section
- The width should be based on the length of the text within it, no col spacing

**Profile:**
- Float the cards to the bottom of the page.
- in the settings section, add a color picker for the employee, that color corelated to thier color on the calendar. It can be a calendar icon 📅
- the database enviornment section can be more like just in the settings and make it more like a dropdown than its own section. 

**Reports:**
- Float the reports to the bottom of the page.

**Settings:**
- Float the settings cards to the bottom of the page
- Add settings for the global settings of the scheduling application. The initial settings will be the start of the day, end of the day, attendance check in required (when selected, it will show the attendance input on the schedules, otherwise not)
- Move the left most menu to the bottom footer of the page that is fixed to the bottom of the page, remove the text, and only keep the icons
- Remove account and API&Debug.
- Move branding and notification inside General
- In the database section, add an import feature there where it should be possible to select the database table, and it will show the table columns in it after selecting the Table from a list. So when the user imports the data via csv format which will be the method of importing. The first top column will be the header column, and the function that processes the import should look at that header column and then dynamically match that column against the column in the datatable to construct the insert query dynamically and insert the records into the database. But before it does the insert, it should look in the code for characters like ' or that would break the insert and replace them with `
- The settings are too text heavy on the surface, I think instead of that, add a question mark icon with a color that blends into the dark/light theme. When selected, it will show the context of the element in question.

**General Settings:**
- For the logo, make there also be an image upload that would save to the branding settings in the database.

**Branding Settings:**
- Brand Name — The official name of the company (e.g., Nike, Apple, Coca-Cola).
- Logo — The main symbol or design that represents the company (the picture or icon people see everywhere).
- Slogan / Tagline — A short, catchy phrase that sums up what the company stands for (e.g., "Just Do It" or "Think Different").
- Color Palette — The specific set of colors the company always uses (e.g., McDonald's red and yellow, Tiffany's blue).
- Typography / Fonts — The style of lettering used in the logo, website, ads, etc. (the fonts make everything look consistent).
- Imagery / Photography Style — The kind of photos, illustrations, or visuals the company chooses (e.g., bright and fun, dark and serious, minimal).
- Brand Voice / Tone — How the company "talks" in messages, social media, ads (friendly, professional, funny, bold, etc.).
- Shape / Icons / Symbols — Any repeating shapes or small icons used in designs (besides the main logo).
- Packaging / Design Style — How products look when wrapped or displayed (boxes, labels, bottles, etc.).
- Brand Story / Mission / Values — The background story, purpose, or beliefs the company shares (often used in about pages or ads).
