import React from 'react';

export default function TableFormat() {
  return ( 
    <div className='min-h-screen w-full pb-[34px]'>
      {/* Scroll container that fills viewport minus (nav + 30px gap) */}
      <div className='h-[calc(100vh-64px)] overflow-y-auto'>
        <table className='w-full min-w-full h-full table-fixed border-separate border-spacing-0'>
        {/* Column widths shared across header, inner table, and footer */}
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead className='sticky top-0 z-30 bg-gray-100 border-b border-gray-200'>
          <tr>
            <td className='px-2 py-2'>Total Products: 10</td>
            <td className='px-2 py-2'>Average Price: $10.00</td>
            <td className='px-2 py-2'>Total Price: $100.00</td>
            <td className='px-2 py-2'></td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className='p-0 h-full w-full align-bottom'>
              <table className='w-full min-w-full table-fixed'>
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className='px-2 py-2'>Product 1</td>
                    <td className='px-2 py-2'>10.00</td>
                    <td className='px-2 py-2'>10</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'><i class="bi bi-pencil"></i></button>
                      <button className='text-red-600 hover:text-red-900'><i class="bi bi-x-circle"></i></button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 2</td>
                    <td className='px-2 py-2'>12.00</td>
                    <td className='px-2 py-2'>8</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'><i class="bi bi-x-circle"></i></button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 3</td>
                    <td className='px-2 py-2'>9.50</td>
                    <td className='px-2 py-2'>14</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 4</td>
                    <td className='px-2 py-2'>7.25</td>
                    <td className='px-2 py-2'>5</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 5</td>
                    <td className='px-2 py-2'>15.00</td>
                    <td className='px-2 py-2'>3</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 6</td>
                    <td className='px-2 py-2'>11.20</td>
                    <td className='px-2 py-2'>6</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 7</td>
                    <td className='px-2 py-2'>13.75</td>
                    <td className='px-2 py-2'>2</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 8</td>
                    <td className='px-2 py-2'>8.80</td>
                    <td className='px-2 py-2'>9</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 9</td>
                    <td className='px-2 py-2'>10.50</td>
                    <td className='px-2 py-2'>12</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 10</td>
                    <td className='px-2 py-2'>6.40</td>
                    <td className='px-2 py-2'>18</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 11</td>
                    <td className='px-2 py-2'>19.99</td>
                    <td className='px-2 py-2'>1</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 12</td>
                    <td className='px-2 py-2'>5.50</td>
                    <td className='px-2 py-2'>20</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 13</td>
                    <td className='px-2 py-2'>14.25</td>
                    <td className='px-2 py-2'>7</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 14</td>
                    <td className='px-2 py-2'>16.00</td>
                    <td className='px-2 py-2'>4</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 15</td>
                    <td className='px-2 py-2'>9.99</td>
                    <td className='px-2 py-2'>11</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 16</td>
                    <td className='px-2 py-2'>21.00</td>
                    <td className='px-2 py-2'>2</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 17</td>
                    <td className='px-2 py-2'>18.30</td>
                    <td className='px-2 py-2'>3</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 18</td>
                    <td className='px-2 py-2'>7.80</td>
                    <td className='px-2 py-2'>13</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 19</td>
                    <td className='px-2 py-2'>12.60</td>
                    <td className='px-2 py-2'>6</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 20</td>
                    <td className='px-2 py-2'>10.10</td>
                    <td className='px-2 py-2'>10</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 21</td>
                    <td className='px-2 py-2'>8.15</td>
                    <td className='px-2 py-2'>9</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 22</td>
                    <td className='px-2 py-2'>17.40</td>
                    <td className='px-2 py-2'>4</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 23</td>
                    <td className='px-2 py-2'>6.90</td>
                    <td className='px-2 py-2'>16</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 24</td>
                    <td className='px-2 py-2'>9.10</td>
                    <td className='px-2 py-2'>11</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 25</td>
                    <td className='px-2 py-2'>13.30</td>
                    <td className='px-2 py-2'>7</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 26</td>
                    <td className='px-2 py-2'>7.70</td>
                    <td className='px-2 py-2'>15</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 27</td>
                    <td className='px-2 py-2'>11.45</td>
                    <td className='px-2 py-2'>6</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 28</td>
                    <td className='px-2 py-2'>10.00</td>
                    <td className='px-2 py-2'>10</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 29</td>
                    <td className='px-2 py-2'>12.10</td>
                    <td className='px-2 py-2'>8</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                  <tr>
                    <td className='px-2 py-2'>Product 30</td>
                    <td className='px-2 py-2'>14.99</td>
                    <td className='px-2 py-2'>5</td>
                    <td className='px-2 py-2'>
                      <button className='text-indigo-600 hover:text-indigo-900 mr-4'>Edit</button>
                      <button className='text-red-600 hover:text-red-900'>Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
        <tfoot className='sticky bottom-0 bg-gray-100 border-t border-gray-200'>
          <tr>
            <th className='px-2 py-2 text-left font-medium'>Name</th>
            <th className='px-2 py-2 text-left font-medium'>Price</th>
            <th className='px-2 py-2 text-left font-medium'>Quantity</th>
            <th className='px-2 py-2 text-right font-medium'>Actions</th>
          </tr>
        </tfoot>
        </table>
      </div>

      {/* Static copy of the Products bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl px-3 py-3 flex items-center justify-center gap-2">
          <button type="button" className="btn-primary flex items-center">
            {/* Inline plus icon */}
            <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Product
          </button>
          <button type="button" className="flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm">
            Monthly Sales
          </button>
        </div>
      </div>
    </div>
  );
}



// <tr>
// <td>Product 1</td>
// <td>10.00</td>
// <td>10</td>
// <td>
//     <button>Edit</button>
//     <button>Delete</button>
// </td>
// </tr>