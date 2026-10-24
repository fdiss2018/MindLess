export class Entretien {
  constructor({
    id, type, date, kilometrage = 0, cout = null, garage = '', notes = '',
    creePar, dateCreation,
  } = {}) {
    this.id = id;
    this.type = type;
    this.date = date; // string ISO "AAAA-MM-JJ"
    this.kilometrage = kilometrage;
    this.cout = cout;
    this.garage = garage;
    this.notes = notes;
    this.creePar = creePar;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new Entretien({ id, ...data });
  }

  toFirestore() {
    return {
      type: this.type,
      date: this.date,
      kilometrage: this.kilometrage,
      cout: this.cout,
      garage: this.garage,
      notes: this.notes,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
    };
  }
}
