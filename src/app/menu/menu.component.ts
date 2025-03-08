import { Component, OnInit } from '@angular/core';
import { menusText } from '../menu';

const splitStringByDelimiters = (str: string, delimiters: string[]): string[] => {
  const regexPattern = delimiters.map(delimiter =>
      delimiter.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
  ).join("|");

  const regex = new RegExp(regexPattern, 'g');

  return str.split(regex).filter(Boolean); 
};

const processString = (inputString: string): string => {
  let updatedString = inputString.replace(/\n/g, ' ');
  updatedString = updatedString.replace(/\s\s+/g, ' ');

  const regex = /ή (?=[Α-Ω])/g;
  const indexes: number[] = [];
  let match;
  
  while ((match = regex.exec(updatedString)) !== null) {
      indexes.push(match.index);
  }

  for (let i = indexes.length - 1; i >= 0; i--) {
      const index = indexes[i];
      updatedString = updatedString.substring(0, index) + '$' + updatedString.substring(index + 1);
  }
  
  return updatedString.replaceAll("("," ").replaceAll(")"," "); 
};


@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit  {
  previous_location: number[] | null = null;
    title = 'angthesis';
    currentCoords: GeolocationPosition | null = null;
    menusText: string[] = [];

    ngOnInit() {
        
        menusText.subscribe(menusText => {
            this.menusText = menusText;
            this.initializeMenus();
        });
    }

    parseMenus(menus_text: string[]): any {
        let menus_structured: any = {};
        let breakfast = menus_text[0].toLowerCase();
        let lunch = processString(menus_text[2]).toLowerCase();
        let dinner = processString(menus_text[1]).toLowerCase();

        let breakfast_items = breakfast.split(',').map(item => item.trim());
        let breakfast_drinks = breakfast_items.slice(0, 4);
        let breakfast_main: string;
        let breakfast_slices: string[];

        if (breakfast_items[breakfast_items.length - 1] != "τυρί") {
            breakfast_main = breakfast_items[breakfast_items.length - 1];
            breakfast_slices = breakfast_items.slice(4, breakfast_items.length - 1);
        } else {
            breakfast_main = breakfast_items[breakfast_items.length - 2] + "-" + breakfast_items[breakfast_items.length - 1];
            breakfast_slices = breakfast_items.slice(4, breakfast_items.length - 2);
        }
        let breakfast_parts = [breakfast_main, breakfast_slices.join(', '), breakfast_drinks.join(', ')];
    
        let split_words = ["πρώτο πιάτο", "κυρίως πιάτο", "μπουφές σαλάτα", "επιδόρπιο"];
    
        lunch = lunch.replaceAll("-", " ").replaceAll("\n", " ").replaceAll(":", "");
        let lunch_parts = splitStringByDelimiters(lunch, split_words).map(item => item.trim());
    
        dinner = dinner.replaceAll("-", " ").replaceAll("\n", " ").replaceAll(":", "");
        let dinner_parts = splitStringByDelimiters(dinner, split_words).map(item => item.trim());
    
        menus_structured = { "lunch": lunch_parts, "dinner": dinner_parts, "breakfast": breakfast_parts };
        return menus_structured;
    }
        
    capitalizeFirstLetter(string: string): string {
        return string.trim().charAt(0).toUpperCase() + string.trim().slice(1);
      }
    
    capitalizeAfterBr(htmlString: string): string {
    return htmlString.replace(/(<br><br>)(.)/g, function(match, p1, p2) {
        return p1 + p2.trim().toUpperCase();
    });
    }
    
    addMenuItems(menus: { [mealType: string]: string[] }): void {
        
        Object.entries(menus).forEach(([mealType, menuItems]) => {
            const menuContainer = document.getElementById(`${mealType}-menu`);
            if (menuContainer) {
                menuItems.forEach(item => {
                    let itemProcessed = item.replace(/\s*\$\s*/g, "<br><br>");
                    itemProcessed = this.capitalizeFirstLetter(itemProcessed);
                    itemProcessed = this.capitalizeAfterBr(itemProcessed);
                    itemProcessed = this.refineCommas(itemProcessed);
                    itemProcessed = itemProcessed.replaceAll("<br><br>", "</p><hr><p>");
                    const blob = document.createElement('div');
                    blob.className = 'menu-blob';
                    blob.innerHTML = `<p>${itemProcessed}</p>`;
                    menuContainer.appendChild(blob);
                });
            }
        });
    }
    
    private refineCommas(inputString: string): string {
        return inputString.replace(/\s*,\s*/g, ', ').replace(/,+\s*$/, '').trim();
    }

    initializeMenus(): void {
        var menus = this.parseMenus(this.menusText);
        this.addMenuItems(menus);
      }
}
