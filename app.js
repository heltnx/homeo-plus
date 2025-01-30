import { TubeService } from './js/tube-service.js';
import { ListManager } from './js/list-manager.js';

class TubeManager {
    constructor() {
        this.listsContainer = document.getElementById('lists-container');
        this.listTemplate = document.getElementById('list-template');
        this.tubeTemplate = document.getElementById('tube-template');
        this.addListBtn = document.getElementById('addListBtn');
        this.listManagers = new Map();
        this.currentEditingTubeId = null;

        if (!this.listsContainer || !this.listTemplate || !this.tubeTemplate || !this.addListBtn) {
            console.error('Éléments HTML manquants');
            return;
        }

        this.setupEventListeners();
        this.loadLists();
        this.setupRealtimeSubscription();

        // Ajout d'un écouteur pour sauvegarder lors de la fermeture de la page
        window.addEventListener('beforeunload', () => {
            if (this.currentEditingTubeId) {
                this.saveCurrentEditingTube();
            }
        });
    }

    setupEventListeners() {
        this.addListBtn.addEventListener('click', () => this.createNewList());
    }

    async loadLists() {
        try {
            console.log('Chargement des listes...');
            const lists = await TubeService.getLists();
            const tubes = await TubeService.getTubes();
            console.log('Données chargées:', { lists, tubes });
            this.renderLists(lists || [], tubes || []);
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        }
    }

    setupRealtimeSubscription() {
        try {
            const subscription = supabase
                .from('lists')
                .on('*', () => this.loadLists())
                .subscribe();

            const tubesSubscription = supabase
                .from('tubes')
                .on('*', () => this.loadLists())
                .subscribe();

            console.log('Subscriptions établies:', { subscription, tubesSubscription });
        } catch (error) {
            console.error('Erreur lors de la configuration des subscriptions:', error);
        }
    }

    renderLists(lists, tubes) {
        if (!this.listsContainer) return;

        const expandedLists = new Set();
        this.listsContainer.querySelectorAll('.list').forEach(list => {
            if (list.classList.contains('expanded')) {
                expandedLists.add(list.dataset.listId);
            }
        });

        this.listsContainer.innerHTML = '';
        console.log('Rendu des listes:', lists);

        lists.forEach(list => {
            const listElement = this.createListElement(list);
            const listTubes = tubes.filter(tube => tube.list_id === list.id);
            this.renderTubes(listElement, listTubes);

            if (expandedLists.has(list.id)) {
                listElement.classList.add('expanded');
            }

            this.listsContainer.appendChild(listElement);

            const listManager = new ListManager(listElement, list, listTubes);
            this.listManagers.set(list.id, listManager);
        });
    }

    createListElement(list) {
        if (!this.listTemplate) return null;

        const listElement = this.listTemplate.content.cloneNode(true).firstElementChild;
        listElement.dataset.listId = list.id;
        listElement.dataset.name = list.name.toLowerCase();

        const titleElement = listElement.querySelector('h2');
        if (titleElement) {
            titleElement.textContent = list.name;
        }

        this.setupListEventListeners(listElement, list);
        return listElement;
    }

    setupListEventListeners(listElement, list) {
        const header = listElement.querySelector('.list-header');
        const titleElement = listElement.querySelector('h2');
        const deleteBtn = listElement.querySelector('.btn-delete');
        const tubeForm = listElement.querySelector('.tube-form');

        // Ajout du bouton pour tous les modes
        const addTubeBtn = document.createElement('button');
        addTubeBtn.className = 'add-tube-btn';
        addTubeBtn.innerHTML = '<i class="icon-plus"></i> Ajouter un tube';
        tubeForm.parentNode.insertBefore(addTubeBtn, tubeForm);

        addTubeBtn.addEventListener('click', () => {
            tubeForm.classList.toggle('expanded');
        });

        // Gestion du comportement du header
        header.addEventListener('click', (e) => {
            if (!e.target.matches('h2, input')) {
                listElement.classList.toggle('expanded');
            }
        });

        // Gestion des clics et double-clics sur le titre
        titleElement.addEventListener('click', (e) => {
            setTimeout(() => {
                if (!e.detail || e.detail === 1) {
                    listElement.classList.toggle('expanded');
                }
            }, 200);
        });

        titleElement.addEventListener('dblclick', (e) => {
            e.stopPropagation(); // Empêche le toggle de la liste

            const currentName = titleElement.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'list-title-input';

            const saveTitle = async () => {
                const newName = input.value.trim();
                // Sauvegarde ce qui est visible, même si c'est vide
                await TubeService.updateList(list.id, newName);
                await this.loadLists();
            };

            const exitEditMode = async () => {
                await saveTitle();
                if (input.parentNode) {
                    input.replaceWith(titleElement);
                }
            };

            input.addEventListener('blur', exitEditMode);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });

            // Ajout d'un écouteur global pour détecter les clics hors du champ
            const onClickOutside = (event) => {
                if (!input.contains(event.target)) {
                    input.blur();
                    document.removeEventListener('click', onClickOutside); // Supprime l'écouteur
                }
            };
            document.addEventListener('click', onClickOutside);

            titleElement.replaceWith(input);
            input.focus();
        });

        deleteBtn.addEventListener('click', () => {
            if (confirm('Voulez-vous vraiment supprimer cette liste et tous ses tubes ?')) {
                this.deleteList(list.id);
            }
        });

        tubeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addTube(list.id, tubeForm);
            tubeForm.classList.remove('expanded');
            await this.loadLists();
        });
    }



    renderTubes(listElement, tubes) {
        const tubesContainer = listElement.querySelector('.tubes-list');
        tubesContainer.innerHTML = '';

        tubes.forEach(tube => {
            const tubeElement = this.createTubeElement(tube);
            tubesContainer.appendChild(tubeElement);
        });

        const totalTubes = tubes.reduce((sum, tube) => sum + tube.quantity, 0);
        const tubeCount = listElement.querySelector('.tube-count');
        if (tubeCount) {
            tubeCount.textContent = `${totalTubes} tube${totalTubes !== 1 ? 's' : ''}`;
        }
    }

    createTubeElement(tube) {
        const tubeElement = this.tubeTemplate.content.cloneNode(true).firstElementChild;
        this.renderTubeContent(tubeElement, tube);
        return tubeElement;
    }

    async saveCurrentEditingTube() {
        const currentEditingElement = document.querySelector(`[data-tube-id="${this.currentEditingTubeId}"]`);
        if (currentEditingElement) {
            const newName = currentEditingElement.querySelector('.tube-name').value;
            const newQuantity = parseInt(currentEditingElement.querySelector('.tube-quantity').value);
            const newUsage = currentEditingElement.querySelector('.tube-usage').value;

            if (newName && !isNaN(newQuantity) && newQuantity >= 0) {
                try {
                    await TubeService.updateTube(
                        this.currentEditingTubeId,
                        newName,
                        newUsage,
                        newQuantity
                    );
                    this.currentEditingTubeId = null;
                    await this.loadLists();
                } catch (error) {
                    console.error('Erreur lors de la sauvegarde du tube:', error);
                }
            }
        }
    }

    renderTubeContent(tubeElement, tube, isEditing = false) {
        if (isEditing) {
            // Si on essaie d'éditer un nouveau tube alors qu'un autre est en cours d'édition
            if (this.currentEditingTubeId && this.currentEditingTubeId !== tube.id) {
                this.saveCurrentEditingTube();
            }

            this.currentEditingTubeId = tube.id;
            tubeElement.classList.add('editing');
            tubeElement.dataset.tubeId = tube.id;
            tubeElement.innerHTML = `
                <textarea class="tube-name" rows="1">${tube.name}</textarea>
                <input type="number" class="tube-quantity" value="${tube.quantity}" min="1">
                <textarea class="tube-usage" rows="1">${tube.usage || ''}</textarea>
            `;

            // Ajuster automatiquement la hauteur des textareas
            const textareas = tubeElement.querySelectorAll('textarea');
            textareas.forEach(textarea => {
                textarea.addEventListener('input', function () {
                    this.style.height = 'auto';
                    this.style.height = this.scrollHeight + 'px';
                });
                // Déclencher l'événement input pour ajuster initialement la hauteur
                textarea.dispatchEvent(new Event('input'));
            });

            // Ajout des écouteurs pour la sauvegarde automatique
            const inputs = tubeElement.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('blur', async () => {
                    await this.saveCurrentEditingTube();
                });
            });

        } else {
            tubeElement.classList.remove('editing');
            tubeElement.dataset.tubeId = tube.id;
            tubeElement.innerHTML = `
                <span class="tube-name" role="button">${tube.name}</span>
                <span class="tube-quantity" role="button">${tube.quantity}</span>
                <span class="tube-usage" role="button">${tube.usage || ''}</span>
                <button class="btn btn-delete"><i class="icon-trash"></i></button>
            `;

            // Ajouter les écouteurs pour l'édition au clic sur chaque champ
            const fields = tubeElement.querySelectorAll('[role="button"]');
            fields.forEach(field => {
                field.addEventListener('click', () => {
                    this.renderTubeContent(tubeElement, tube, true);
                });
            });
        }

        const deleteBtn = tubeElement.querySelector('.btn-delete');
        if (deleteBtn && !isEditing) {  // Only add delete button listener in non-editing mode
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();  // Prevent event bubbling
                this.deleteTube(tube.id);
            });
        }
    }

    async createNewList() {
        try {
            const name = prompt('Nom de la nouvelle liste:');
            if (name) {
                await TubeService.createList(name);
                await this.loadLists();
            }
        } catch (error) {
            console.error('Erreur lors de la création de la liste:', error);
        }
    }

    async editList(list, listElement) {
        const titleElement = listElement.querySelector('h2');
        const currentName = titleElement.textContent;
        const newName = prompt('Nouveau nom de la liste:', currentName);

        if (newName && newName !== currentName) {
            try {
                await TubeService.updateList(list.id, newName);
                await this.loadLists();
            } catch (error) {
                console.error('Erreur lors de la modification de la liste:', error);
            }
        }
    }

    async deleteList(listId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette liste ?')) {
            try {
                await TubeService.deleteList(listId);
                await this.loadLists();
            } catch (error) {
                console.error('Erreur lors de la suppression de la liste:', error);
            }
        }
    }

    async addTube(listId, form) {
        const nameInput = form.querySelector('input[name="name"]');
        const quantityInput = form.querySelector('input[name="quantity"]');
        const usageInput = form.querySelector('input[name="usage"]');

        try {
            await TubeService.addTube(
                listId,
                nameInput.value,
                usageInput.value,
                quantityInput.value
            );
            form.reset();
            quantityInput.value = "1";
            await this.loadLists();
        } catch (error) {
            console.error('Erreur lors de l\'ajout du tube:', error);
        }
    }

    async editTube(tube, tubeElement) {
        const newName = prompt('Nouveau nom du tube:', tube.name);
        if (!newName) return;

        const newQuantity = parseInt(prompt('Nouvelle quantité:', tube.quantity));
        if (isNaN(newQuantity) || newQuantity < 1) return;

        const newUsage = prompt('Nouvelle utilité:', tube.usage || '');

        try {
            await TubeService.updateTube(tube.id, newName, newUsage, newQuantity);
            await this.loadLists();
        } catch (error) {
            console.error('Erreur lors de la modification du tube:', error);
        }
    }

    async deleteTube(tubeId) {
        if (confirm('Voulez-vous vraiment supprimer ce tube ?')) {
            try {
                await TubeService.deleteTube(tubeId);
                await this.loadLists();
            } catch (error) {
                console.error('Erreur lors de la suppression du tube:', error);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de TubeManager...');
    new TubeManager();
});
