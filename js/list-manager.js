export class ListManager {
    constructor(listElement, list, tubes) {
        this.listElement = listElement;
        this.list = list;
        this.tubes = tubes;
        this.searchTerm = '';
        this.setupSearchField();
    }

    setupSearchField() {
        const searchField = this.listElement.querySelector('.tube-search');
        searchField.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterTubes();
        });
    }

    filterTubes() {
        const tubesList = this.listElement.querySelector('.tubes-list');
        const tubes = tubesList.children;
        
        Array.from(tubes).forEach(tube => {
            const name = tube.querySelector('.tube-name').textContent.toLowerCase();
            const usage = tube.querySelector('.tube-usage').textContent.toLowerCase();
            const quantity = tube.querySelector('.tube-quantity').textContent;
            
            const matches = name.includes(this.searchTerm) || 
                           usage.includes(this.searchTerm) || 
                           quantity.includes(this.searchTerm);
            
            tube.style.display = matches ? '' : 'none';
        });
    }

    updateTubeCount() {
        const tubeCount = this.listElement.querySelector('.tube-count');
        const totalTubes = this.tubes.reduce((sum, tube) => sum + tube.quantity, 0);
        tubeCount.textContent = `${totalTubes} tube${totalTubes !== 1 ? 's' : ''}`;
    }
}