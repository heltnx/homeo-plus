// app.js

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
        this.addEmailButtons(); // Ajoute les boutons e-mail initialement
        this.observeListChanges(); // Démarre l'observateur après avoir initialisé les boutons
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

            // Vérifier si les données tubes sont bien chargées
            tubes.forEach(tube => {
                console.log('Tube data:', tube); // Log chaque tube pour inspection
            });
            this.renderLists(lists || [], tubes || []);
            this.addEmailButtons(); // Ajoute les boutons e-mail après le rendu des listes
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

        // Ajoute les boutons ici aussi, après le rendu initial
        this.addEmailButtons();
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
            const newStockMini = parseInt(currentEditingElement.querySelector('.stock_mini').value);

            if (newName && !isNaN(newQuantity) && newQuantity >= 0) {
                try {
                    await TubeService.updateTube(
                        this.currentEditingTubeId,
                        newName,
                        null,
                        newUsage,
                        newQuantity,
                        newStockMini,
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
                <input type="number" class="stock_mini" value="${tube.stock_mini}" min="0">
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
                <span class="stock_mini" role="button">${tube.stock_mini || ''}</span>
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
        if (deleteBtn && !isEditing) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
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
        const stockMiniInput = form.querySelector('input[name="stock_mini"]');

        try {
            await TubeService.addTube(
                listId,
                nameInput.value,
                null,
                usageInput.value,
                quantityInput.value,
                stockMiniInput.value
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
        const newStockMini = prompt('Nouveau stock mini:', tube.stock_mini);

        try {
            await TubeService.updateTube(tube.id, newName, null, newUsage, newQuantity, newStockMini);
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
    // Ajout d'un bouton d'envoi par liste spécifique
    addEmailButtons() {
        document.querySelectorAll('.list').forEach(list => {
            const listContent = list.querySelector('.list-content');
            if (listContent && !listContent.querySelector('.btn-email')) { // Vérifie si le bouton existe déjà
                const sendEmailBtn = document.createElement('button');
                sendEmailBtn.textContent = 'Mail Commande';
                sendEmailBtn.className = 'btn btn-email';
                listContent.prepend(sendEmailBtn); // Utilise prepend pour l'ajouter en premier

                sendEmailBtn.addEventListener('click', (event) => {
                    event.preventDefault(); // Empêche la navigation si nécessaire
                    event.stopPropagation(); // Empêche la propagation aux parents

                    console.log('Bouton cliqué pour la liste:', list.querySelector('h2').textContent);
                    if (list.classList.contains('expanded')) { // Vérifie si la liste est ouverte
                        this.sendEmailWithZeroQuantityTubes(list); // Utilise `this` pour accéder à la méthode
                    }
                });
            }
        });
    }

    observeListChanges() {
        if (!this.listsContainer) {
            console.warn('lists-container not found, cannot observe list changes.');
            return;
        }

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('list')) {
                            console.log('Nouvelle liste détectée, ajout des boutons e-mail');
                            this.addEmailButtons(); // Utilise `this` pour accéder à la méthode
                        }
                    });
                }
            });
        });

        observer.observe(this.listsContainer, { childList: true, subtree: true });
    }
    sendEmailWithZeroQuantityTubes(targetList) {
        const listName = targetList.querySelector('h2').textContent;
        const tubesACommander = [];
        const targetListId = targetList.dataset.listId; // Récupérer l'ID de la liste cliquée

        // Trouver le listManager correspondant à la targetList
        let listManagerPourCetteListe = null;
        for (const listManager of this.listManagers.values()) {
            if (listManager.list.id === targetListId) {  // Comparaison des ID
                listManagerPourCetteListe = listManager;
                break;
            }
        }

        if (!listManagerPourCetteListe) {
            console.warn("Aucun listManager trouvé pour cette liste:", listName);
            return;
        }

        // Filtrer les tubes de CETTE liste
        listManagerPourCetteListe.tubes.forEach(tube => {
            if (tube.quantity < tube.stock_mini) {
                const quantiteACommander = tube.stock_mini - tube.quantity;
                let nomTube = listName.toLowerCase().includes("just espagne") ? tube.esp : tube.name;

                // Ajout de la quantité en stock (en rouge)
                const stockQuantity = `(${tube.quantity})`;
                tubesACommander.push(`${stockQuantity}     ${quantiteACommander}  ${nomTube}`);
            }
        });

        if (tubesACommander.length === 0) {
            alert('Aucun tube à commander dans cette liste.');
            return;
        }

        // Construire le message de l'e-mail
        const subject = encodeURIComponent(`Commande ${listName}`);
        const body = encodeURIComponent(
            'Livraison à Mme Winckel: carrer San Bartolomeu 77 - 5e izquierda - 03560 El Campello - Provincia de Alicante":\n\n' +
            tubesACommander.join('\n')
        );

        // Ouvrir le client de messagerie
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de TubeManager...');
    new TubeManager();
});